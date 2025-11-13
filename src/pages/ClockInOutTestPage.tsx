import { ClockInOutTest } from "@/components/ClockInOutTest";

export const ClockInOutTestPage = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Clock-In/Out Testing</h1>
        <p className="text-muted-foreground mt-2">
          Test and trace clock-in/out operations with detailed backend logging and performance metrics.
        </p>
      </div>
      <ClockInOutTest />
    </div>
  );
};
