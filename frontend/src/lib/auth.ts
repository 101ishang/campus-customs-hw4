export type AuthUser = {
  id: number;
  name: string;
  email: string;
  first_name: string;
  last_name: string;
};

type AuthResponse = { user: AuthUser };

async function readResponse(response: Response): Promise<{ user?: AuthUser; error?: string }> {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "The account request could not be completed.");
  }
  return result as AuthResponse;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (response.status === 401) return null;
  const result = await readResponse(response);
  return result.user ?? null;
}

export async function logIn(email: string, password: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await readResponse(response);
  if (!result.user) throw new Error("The server did not return an account.");
  return result.user;
}

export async function createAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await readResponse(response);
  if (!result.user) throw new Error("The server did not return the new account.");
  return result.user;
}

export async function logOut(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  await readResponse(response);
}
