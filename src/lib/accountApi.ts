// Deleting the whole Supabase account from inside the app (pure and tested in scripts/test-sync.ts).
// The deletion happens in a SQL function inside the person's OWN Supabase project (security definer, scoped to the
// signed-in user), so no admin key ever needs to be inside the app.
import { friendlyCloudError } from './cloudConfig';

export type RpcClient = { rpc: (fn: string) => PromiseLike<{ error: { message?: string; code?: string } | null }> };

export const DELETE_FUNCTION = 'delete_my_account';

/** Calls the deletion function. Throws a plain-language error when it fails (for example when the SQL has not been updated yet). */
export async function deleteAccountRemote(client: RpcClient): Promise<void> {
  const { error } = await client.rpc(DELETE_FUNCTION);
  if (error) {
    const missing = error.code === 'PGRST202' || /could not find the function|delete_my_account/i.test(error.message ?? '');
    throw new Error(missing ? 'Account deletion needs the updated setup SQL. Tap "Share the setup SQL", run it in Supabase → SQL Editor, then try again.' : friendlyCloudError(error));
  }
}
