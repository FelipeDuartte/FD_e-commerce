let notificationAudio = null;
export function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio("/notification.mp3");
      notificationAudio.volume = 1;
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
  } catch (error) {
    console.warn("Não foi possível tocar a notificação.", error);
  }
}
