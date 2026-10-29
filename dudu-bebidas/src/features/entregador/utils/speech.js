// Instruções faladas da navegação (voz do próprio celular, pt-BR, sem custo).

export function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// O iPhone só deixa a página falar se a primeira fala vier de um toque —
// chamado no clique do botão "Navegar aqui".
export function unlockSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}
