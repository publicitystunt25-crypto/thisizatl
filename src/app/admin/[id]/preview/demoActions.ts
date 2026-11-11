"use server";

// Stand-ins for the review buttons on the admin preview. They do nothing, so
// admins can click through exactly what the submitter sees without changing the post.
export async function demoGoLive(): Promise<void> {}
export async function demoSchedule(_formData: FormData): Promise<void> {}
export async function demoRequestChanges(_formData: FormData): Promise<void> {}
