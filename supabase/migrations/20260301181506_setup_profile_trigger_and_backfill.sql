-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.phone
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users into profiles
INSERT INTO public.profiles (id, email, phone)
SELECT id, email, phone
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email, phone = EXCLUDED.phone;;
