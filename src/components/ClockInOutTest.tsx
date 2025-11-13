import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Clock, Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { todayInGST } from '@/lib/timezone';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LogEntry {
  timestamp: string;
  step: string;
  duration?: number;
  data?: any;
  error?: string;
  source: 'client' | 'server';
}

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  logs: LogEntry[];
  total_duration_ms?: number;
  client_logs?: LogEntry[];
  network_info?: {
    request_time: number;
    response_time: number;
    total_network_time: number;
  };
}

export const ClockInOutTest = ({ employeeId: initialEmployeeId }: { employeeId?: string }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || "");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [clientLogs, setClientLogs] = useState<LogEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const today = todayInGST();

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Add client-side log
  const addClientLog = (step: string, data?: any, error?: string, startTime?: number) => {
    const log: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      duration: startTime ? Date.now() - startTime : undefined,
      data,
      error,
      source: 'client',
    };
    setClientLogs(prev => [...prev, log]);
    console.log(`[CLIENT] ${step}`, data || error);
    return log;
  };

  // Fetch employees for admin selection
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, email')
        .eq('status', 'active')
        .order('full_name');

      if (!error && data) {
        setEmployees(data);
        if (!initialEmployeeId && data.length > 0) {
          setSelectedEmployeeId(data[0].id);
        }
      }
      setLoadingEmployees(false);
    };

    fetchEmployees();
  }, [initialEmployeeId]);

  const runTest = async (action: 'clock-in' | 'clock-out') => {
    if (!selectedEmployeeId) {
      toast({
        title: "No Employee Selected",
        description: "Please select an employee to test",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setClientLogs([]);
    
    try {
      const overallStartTime = Date.now();
      
      // Log test initiation
      addClientLog('TEST_INITIATED', { 
        action, 
        employee_id: selectedEmployeeId,
        date: today,
        user_agent: navigator.userAgent,
        online: navigator.onLine,
        connection: (navigator as any).connection?.effectiveType || 'unknown'
      });

      toast({
        title: "Test Started",
        description: `Testing ${action} operation...`,
      });

      // Log request preparation
      const prepStartTime = Date.now();
      const requestBody = {
        action,
        employee_id: selectedEmployeeId,
        date: today,
        tested_by: currentUserId,
        user_agent: navigator.userAgent,
      };
      addClientLog('REQUEST_PREPARED', { body: requestBody }, undefined, prepStartTime);

      // Log network request start
      const networkStartTime = Date.now();
      addClientLog('NETWORK_REQUEST_STARTED', { 
        endpoint: 'clock-in-out',
        method: 'POST'
      });

      // Make API call
      const { data, error } = await supabase.functions.invoke('clock-in-out', {
        body: requestBody,
      });

      const networkEndTime = Date.now();
      const networkDuration = networkEndTime - networkStartTime;

      // Log network response
      addClientLog('NETWORK_RESPONSE_RECEIVED', { 
        duration: networkDuration,
        status: error ? 'error' : 'success',
        response_size: JSON.stringify(data || error).length + ' bytes'
      }, undefined, networkStartTime);

      const totalClientDuration = Date.now() - overallStartTime;

      if (error) {
        addClientLog('CLIENT_ERROR_HANDLED', { 
          error: error.message,
          error_code: error.code 
        });

        setTestResult({
          success: false,
          error: error.message,
          logs: [],
          total_duration_ms: totalClientDuration,
          client_logs: clientLogs,
          network_info: {
            request_time: networkStartTime - overallStartTime,
            response_time: networkDuration,
            total_network_time: networkDuration
          }
        });

        toast({
          title: "Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Log successful response processing
        addClientLog('RESPONSE_PARSED', { 
          success: data.success,
          server_duration: data.total_duration_ms,
          server_logs_count: data.logs?.length || 0
        });

        // Calculate latency overhead
        const latencyOverhead = totalClientDuration - (data.total_duration_ms || 0);
        addClientLog('TEST_COMPLETED', { 
          total_client_duration: totalClientDuration,
          server_duration: data.total_duration_ms,
          network_latency: latencyOverhead,
          latency_percentage: ((latencyOverhead / totalClientDuration) * 100).toFixed(2) + '%'
        }, undefined, overallStartTime);

        // Merge client and server logs
        const mergedLogs = [
          ...clientLogs.map(log => ({ ...log, source: 'client' as const })),
          ...(data.logs || []).map((log: any) => ({ ...log, source: 'server' as const }))
        ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        setTestResult({
          ...data,
          client_logs: clientLogs,
          logs: mergedLogs,
          network_info: {
            request_time: networkStartTime - overallStartTime,
            response_time: networkDuration,
            total_network_time: networkDuration
          }
        });

        toast({
          title: data.success ? "Test Successful" : "Test Failed",
          description: data.success 
            ? `${action} completed - Client: ${totalClientDuration}ms | Server: ${data.total_duration_ms}ms` 
            : data.error,
          variant: data.success ? "default" : "destructive",
        });
      }
    } catch (err: any) {
      addClientLog('UNEXPECTED_CLIENT_ERROR', { error: err.message, stack: err.stack });
      
      setTestResult({
        success: false,
        error: err.message,
        logs: [],
        client_logs: clientLogs,
      });
      
      toast({
        title: "Test Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStepIcon = (step: string, hasError?: string, source?: string) => {
    if (hasError) return <XCircle className="h-4 w-4 text-destructive" />;
    if (step.includes('COMPLETED')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStepColor = (step: string, hasError?: string, source?: string) => {
    if (hasError) return 'text-destructive';
    if (step.includes('COMPLETED')) return 'text-green-600';
    if (step.includes('STARTED')) return 'text-blue-600';
    if (step.includes('FAILED')) return 'text-orange-600';
    return 'text-foreground';
  };

  const getSourceBadge = (source: string) => {
    return source === 'client' 
      ? <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">Browser</Badge>
      : <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">Server</Badge>;
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Clock-In/Out Test Suite
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Employee Selection (if no initial employee provided) */}
        {!initialEmployeeId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Employee to Test</label>
            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              disabled={loadingEmployees || testing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Test Controls */}
        <div className="flex gap-3">
          <Button
            onClick={() => runTest('clock-in')}
            disabled={testing || !selectedEmployeeId}
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Test Clock-In
          </Button>
          <Button
            onClick={() => runTest('clock-out')}
            disabled={testing || !selectedEmployeeId}
            variant="secondary"
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Test Clock-Out
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-semibold">
                  {testResult.success ? 'Success' : 'Failed'}
                </span>
              </div>
              {testResult.total_duration_ms && (
                <Badge variant="outline">
                  {testResult.total_duration_ms}ms
                </Badge>
              )}
            </div>

            {/* Error Message */}
            {testResult.error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  Error: {testResult.error}
                </p>
              </div>
            )}

            {/* Network Performance */}
            {testResult.network_info && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium mb-2">Network Performance:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Request Prep</p>
                    <p className="font-medium">{testResult.network_info.request_time}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Network Time</p>
                    <p className="font-medium">{testResult.network_info.response_time}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Network</p>
                    <p className="font-medium">{testResult.network_info.total_network_time}ms</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Data */}
            {testResult.success && testResult.data && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium mb-2">Operation Data:</p>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </div>
            )}

            {/* Execution Logs */}
            {testResult.logs && testResult.logs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Execution Trace ({testResult.logs.length} steps)
                </h4>
                <ScrollArea className="h-96 border rounded-lg">
                  <div className="p-3 space-y-2">
                    {testResult.logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-2 rounded text-xs font-mono ${
                          log.source === 'client' 
                            ? 'bg-blue-500/5 border border-blue-500/10' 
                            : 'bg-purple-500/5 border border-purple-500/10'
                        }`}
                      >
                        {getStepIcon(log.step, log.error, log.source)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {getSourceBadge(log.source)}
                              <span className={`font-semibold ${getStepColor(log.step, log.error, log.source)}`}>
                                {log.step}
                              </span>
                            </div>
                            {log.duration !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                +{log.duration}ms
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}
                          </div>
                          {log.data && (
                            <pre className="text-xs mt-1 overflow-auto text-foreground/80">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          )}
                          {log.error && (
                            <p className="text-destructive mt-1">
                              Error: {log.error}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!testResult && !testing && (
          <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <p className="font-medium mb-1">Test Features:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Browser-side operation logging</li>
              <li>Network performance metrics</li>
              <li>Backend execution trace</li>
              <li>Step-by-step timing measurements</li>
              <li>Database operation logging</li>
              <li>Client vs Server comparison</li>
              <li>Error tracking and reporting</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
