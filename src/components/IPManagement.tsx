import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Plus, Trash2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AllowedIP {
  id: string;
  ip_address: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export const IPManagement = () => {
  const [allowedIPs, setAllowedIPs] = useState<AllowedIP[]>([]);
  const [ipAddress, setIpAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllowedIPs();
  }, []);

  const fetchAllowedIPs = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_ips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(ip => ({
        ...ip,
        ip_address: String(ip.ip_address)
      }));
      
      setAllowedIPs(typedData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch allowed IPs",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress.trim() || !description.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('allowed_ips')
        .insert({
          ip_address: ipAddress.trim(),
          description: description.trim(),
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "IP address added successfully"
      });

      setIpAddress('');
      setDescription('');
      fetchAllowedIPs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add IP address",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('allowed_ips')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `IP ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });

      fetchAllowedIPs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update IP status",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this IP address?')) return;

    try {
      const { error } = await supabase
        .from('allowed_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "IP address deleted successfully"
      });

      fetchAllowedIPs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete IP address",
        variant: "destructive"
      });
    }
  };

  const validateIP = (ip: string) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Add Allowed IP Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.100 or 2001:db8::1"
                  required
                />
                {ipAddress && !validateIP(ipAddress) && (
                  <p className="text-sm text-destructive mt-1">
                    Please enter a valid IPv4 or IPv6 address
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Office network, Home office, etc."
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !validateIP(ipAddress)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add IP Address
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Allowed IP Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allowedIPs.length === 0 ? (
              <p className="text-muted-foreground">No IP addresses configured</p>
            ) : (
              allowedIPs.map(ip => (
                <div key={ip.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{ip.ip_address}</h4>
                      <Badge variant={ip.is_active ? "default" : "secondary"}>
                        {ip.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ip.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Added: {new Date(ip.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(ip.id, ip.is_active)}
                    >
                      {ip.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(ip.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};