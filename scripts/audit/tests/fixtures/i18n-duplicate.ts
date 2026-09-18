// Test fixture — duplicate EN key
// Expected scanner behavior: exit 1, duplicate detected for "hello"
const translations = {
  en: {
    hello: "Hello",
    goodbye: "Goodbye",
    hello: "Hello Duplicate",
  },
  ur: {
    hello: "Salam",
    goodbye: "Khuda Hafiz",
  },
};
export default translations;