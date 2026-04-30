import { Metadata } from 'next';
import { SupabaseAuth } from '@/components/auth/supabase-auth';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create an account for Weekly Status.'
};

export default async function Page() {
  return (
    <main className='bg-muted/30 flex min-h-screen items-center justify-center p-4'>
      <SupabaseAuth mode='sign-up' />
    </main>
  );
}
