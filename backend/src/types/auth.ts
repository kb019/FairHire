export type UserType = "hr" | "applicant";

export interface AuthenticatedUser {
  userId: string;
  userType: UserType;
}

