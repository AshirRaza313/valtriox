// Test fixture — clean i18n
// Expected scanner behavior: exit 0, 0 duplicates, 0 missing
const translations = {
  en: {
    hello: "Hello",
    goodbye: "Goodbye",
    welcome: "Welcome",
  },
  ur: {
    hello: "Salam",
    goodbye: "Khuda Hafiz",
    welcome: "Khush Aamdeed",
  },
};
export default translations;