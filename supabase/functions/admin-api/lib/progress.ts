export interface ProgressSection {
  registeredUsers: number;
  pages: Array<{
    pageKey: string;
    usersWithProgress: number;
    sectionsRead: number;
    quizzesAttempted: number;
    quizzesPassed: number;
    exercisesCompleted: number;
  }>;
}

/** Read the progress aggregate. Uses the service-role client (bypasses RLS). */
export async function fetchProgress(supabaseAdmin: any): Promise<ProgressSection> {
  const [{ count }, { data, error }] = await Promise.all([
    supabaseAdmin.from("runbook_progress").select("user_id", { count: "exact", head: true }),
    supabaseAdmin.from("admin_progress_rollup").select("*").order("users_with_progress", { ascending: false }),
  ]);
  if (error) throw error;
  return {
    registeredUsers: count ?? 0,
    pages: (data ?? []).map((r: any) => ({
      pageKey: r.page_key,
      usersWithProgress: r.users_with_progress,
      sectionsRead: r.sections_read,
      quizzesAttempted: r.quizzes_attempted,
      quizzesPassed: r.quizzes_passed,
      exercisesCompleted: r.exercises_completed,
    })),
  };
}
