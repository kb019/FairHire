const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return emailPattern.test(normalizeEmail(email));
}

export function isValidPassword(password: string) {
  return passwordPattern.test(password);
}

export function validateRegistrationInput(email: string, password: string) {
  const errors: string[] = [];

  if (!isValidEmail(email)) {
    errors.push("Enter a valid email address.");
  }

  if (!isValidPassword(password)) {
    errors.push(
      "Password must be at least 8 characters and include uppercase, lowercase, and a number."
    );
  }

  return errors;
}

