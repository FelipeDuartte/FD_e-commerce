import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
 import.meta.env.VITE_SUPABASE_URL,
import.meta.env.VITE_SUPABASE_KEY
);
// login com google
export const loginGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
    redirectTo: "https://dudu-bebidas.vercel.app"
  }
  });

  if (error) console.log(error);
};
