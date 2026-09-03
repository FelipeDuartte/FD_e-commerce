import { useState } from "react";
import { supabase } from "../../shared/supabase/Supabaseclient";

const EMPTY_FORM = { email: "", password: "", name: "", confirmPassword: "" };

// Concentra todo o estado e as regras do modal de login: alternância
// login/cadastro, "esqueci a senha" (link inline, não é uma tela separada),
// e os dois submits (signInWithPassword / signUp).
export function useAuthForm(onClose) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleChange = (e) => {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setErrorMsg("");
    setSuccessMsg("");
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (isLogin) {
      if (!formData.email || !formData.password) {
        setErrorMsg("Por favor, preencha todos os campos!");
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      setLoading(false);

      if (error) {
        setErrorMsg(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        return;
      }

      setSuccessMsg(`Bem-vindo de volta, ${data.user.email}!`);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);
    } else {
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword
      ) {
        setErrorMsg("Por favor, preencha todos os campos!");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMsg("As senhas não coincidem!");
        return;
      }
      if (formData.password.length < 6) {
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
          },
        },
      });
      setLoading(false);

      if (error) {
        setErrorMsg(
          error.message === "User already registered"
            ? "Este e-mail já está cadastrado."
            : error.message,
        );
        return;
      }

      if (data.user && data.user.identities?.length === 0) {
        setErrorMsg("Este e-mail já está cadastrado.");
        return;
      }

      setSuccessMsg(
        `Cadastro realizado! Verifique seu e-mail para confirmar a conta, ${formData.name}.`,
      );
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!formData.email) {
      setErrorMsg("Digite seu e-mail para receber o link de recuperação.");
      return;
    }

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(formData.email);
    setForgotLoading(false);

    if (error) {
      setErrorMsg(
        error.message ?? "Não foi possível enviar o link. Tente novamente.",
      );
      return;
    }

    setSuccessMsg(
      "Link de recuperação enviado. Verifique seu e-mail e procure por uma mensagem do Supabase.",
    );
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return {
    isLogin, showPassword, setShowPassword, loading, forgotLoading,
    errorMsg, successMsg, formData,
    handleChange, handleSubmit, handleForgotPassword, toggleMode,
  };
}
