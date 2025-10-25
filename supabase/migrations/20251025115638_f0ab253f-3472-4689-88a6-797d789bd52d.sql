-- Allow authenticated users to read admin profiles for notification purposes
CREATE POLICY "Allow users to read admin profiles for notifications"
ON public.profiles
FOR SELECT
TO authenticated
USING (role = 'admin');