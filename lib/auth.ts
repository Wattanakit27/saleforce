export interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  nickname: string;
  position: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}

const COOKIE_NAME = "oxlet_employee";

export function setEmployeeCookie(employee: Employee): void {
  const data = JSON.stringify({
    id: employee.id,
    user_id: employee.user_id,
    display_name: employee.display_name,
    nickname: employee.nickname,
    position: employee.position,
  });
  // Cookie valid for 30 days
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(data)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

export function getEmployeeFromCookie(): Omit<Employee, "access_token" | "created_at" | "updated_at"> | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(rest.join("=")));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearEmployeeCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export function isAdmin(position: string): boolean {
  return position === "admin";
}
