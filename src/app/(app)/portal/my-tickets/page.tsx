import {requireUser} from '@/lib/auth/session';
import {WorkRegister} from '@/components/work/register';
export default async function MyTicketsPage({searchParams}:PageProps<'/portal/my-tickets'>){await requireUser();return <WorkRegister raw={await searchParams} portal/>;}
