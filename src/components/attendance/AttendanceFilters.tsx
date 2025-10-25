import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, X, ChevronDown, Download } from 'lucide-react';

interface AttendanceFiltersProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  monthOptions: { value: string; label: string }[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: 'all' | 'late' | 'early' | 'absent' | 'ontime' | 'issues';
  setStatusFilter: (filter: 'all' | 'late' | 'early' | 'absent' | 'ontime' | 'issues') => void;
  onExport: () => void;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export const AttendanceFilters = ({
  selectedMonth,
  setSelectedMonth,
  monthOptions,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  onExport,
  activeFilterCount,
  onClearFilters,
}: AttendanceFiltersProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const getStatusFilterLabel = (filter: string) => {
    const labels = {
      all: 'All Records',
      late: 'Late Only',
      early: 'Early Only',
      absent: 'Absent Only',
      ontime: 'On-Time Only',
      issues: 'With Issues',
    };
    return labels[filter as keyof typeof labels];
  };

  return (
    <div className="space-y-3">
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-48">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Staff ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2 relative">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:w-64">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="ontime">On-Time Only</SelectItem>
                  <SelectItem value="late">Late Only</SelectItem>
                  <SelectItem value="early">Early Only</SelectItem>
                  <SelectItem value="absent">Absent Only</SelectItem>
                  <SelectItem value="issues">With Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                onClick={onClearFilters}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Active Filter Tags */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {statusFilter !== 'all' && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setStatusFilter('all')}
                >
                  Status: {getStatusFilterLabel(statusFilter)}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {searchTerm && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setSearchTerm('')}
                >
                  Search: "{searchTerm}"
                  <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
