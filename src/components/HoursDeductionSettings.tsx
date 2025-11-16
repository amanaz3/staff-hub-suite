import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Clock, Save, Info } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Alert, AlertDescription } from './ui/alert';

export const HoursDeductionSettings = () => {
  const { settings, isLoading, updateSettings } = useSystemSettings();
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setHours(settings.hours);
      setMinutes(settings.minutes);
    }
  }, [settings]);

  const handleSave = () => {
    // Validate inputs
    const validatedHours = Math.max(0, Math.min(23, hours));
    const validatedMinutes = Math.max(0, Math.min(59, minutes));

    updateSettings({
      hours: validatedHours,
      minutes: validatedMinutes,
      enabled,
    });
  };

  const getExampleText = () => {
    if (!enabled || (hours === 0 && minutes === 0)) {
      return 'No deduction applied - showing actual hours worked';
    }

    const deductionText = `${hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : ''} ${
      minutes > 0 ? `${minutes} min${minutes > 1 ? 's' : ''}` : ''
    }`.trim();

    const originalHours = 8;
    const originalMins = 30;
    const totalOriginalInMins = originalHours * 60 + originalMins;
    const deductionInMins = hours * 60 + minutes;
    const resultInMins = Math.max(0, totalOriginalInMins - deductionInMins);
    const resultHours = Math.floor(resultInMins / 60);
    const resultMins = resultInMins % 60;

    return `Example: 8 Hrs 30 Mins → ${resultHours} Hrs ${resultMins} Mins (${deductionText} deducted)`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily Hours Deduction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Daily Hours Deduction
        </CardTitle>
        <CardDescription>
          Configure automatic time deduction for breaks/lunch from daily hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This deduction will be automatically applied to each working day when calculating weekly
            hours totals and attendance reports. Use this for breaks, lunch periods, or other
            non-working time.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex-1">
            <Label htmlFor="deduction-enabled" className="text-base font-medium">
              Enable Daily Deduction
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically subtract time from each working day
            </p>
          </div>
          <Switch
            id="deduction-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hours">Hours (0-23)</Label>
            <Input
              id="hours"
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
              disabled={!enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minutes">Minutes (0-59)</Label>
            <Input
              id="minutes"
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              disabled={!enabled}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm font-medium mb-1">Preview:</p>
          <p className="text-sm text-muted-foreground">{getExampleText()}</p>
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
