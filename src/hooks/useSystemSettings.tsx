import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface DeductionSettings {
  hours: number;
  minutes: number;
  enabled: boolean;
}

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any; // Json type from Supabase
  description: string | null;
  updated_at: string;
}

export const useSystemSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings', 'daily_hours_deduction'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'daily_hours_deduction')
        .single();

      if (error) throw error;
      
      // Parse the JSONB value into our expected structure
      const parsed = data as any;
      return {
        ...parsed,
        setting_value: parsed.setting_value as DeductionSettings
      };
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: DeductionSettings) => {
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          setting_value: newSettings as any, // Cast to any for JSONB
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'daily_hours_deduction')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: 'Settings Updated',
        description: 'Hours deduction settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update settings: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const getDeductionInHours = (): number => {
    if (!settings?.setting_value?.enabled) return 0;
    const { hours = 0, minutes = 0 } = settings.setting_value;
    return hours + minutes / 60;
  };

  return {
    settings: settings?.setting_value,
    isLoading,
    updateSettings: updateSettings.mutate,
    getDeductionInHours,
  };
};
