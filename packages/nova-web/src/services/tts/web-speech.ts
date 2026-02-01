import type { TTSService } from '../../types';

/**
 * Web Speech API TTS implementation (free browser-native fallback)
 */
export class WebSpeechTTSService implements TTSService {
  private synthesis: SpeechSynthesis;
  private speaking = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice settings
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to find a good voice
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && v.name.includes('Natural')
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.speaking = true;
      };

      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };

      utterance.onerror = (event) => {
        this.speaking = false;
        // 'canceled' and 'interrupted' are expected when speech is stopped/replaced
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          reject(new Error(`Speech synthesis error: ${event.error}`));
        } else {
          resolve();
        }
      };

      this.synthesis.speak(utterance);
    });
  }

  stop(): void {
    this.synthesis.cancel();
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}
