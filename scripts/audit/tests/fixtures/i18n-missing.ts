// Test fixture — EN/UR parity mismatch
// Expected scanner behavior: exit 1, "welcome" missing in UR
const translations = {
  en: {
    hello: "Hello",
    goodbye: "Goodbye",
    welcome: "Welcome",
  },
  ur: {
    hello: "Salam",
    goodbye: "Khuda Hafiz",
  },
};
export default translations;