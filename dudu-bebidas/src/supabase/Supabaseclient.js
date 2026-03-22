import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://ixjhyzzocdsufcqgbbvf.supabase.co",
  "sb_publishable_kA5ukt5jIQMlUGAw7PVfSA_wsoJIhL_"
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
