import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth/session';
export default async function NewTicketPage(){await requireUser();redirect('/work/new');}
