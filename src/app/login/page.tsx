import { LoginScreen } from "./login-screen";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  return <LoginScreen deactivated={reason === "inactive"} />;
}
