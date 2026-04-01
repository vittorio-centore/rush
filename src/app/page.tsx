import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import LandingExperience from "./LandingExperience";

const CATEGORIES = [
  "Business",
  "Engineering",
  "Pre-Law",
  "Pre-Med",
  "Arts & Culture",
  "Athletics",
  "Greek Life",
  "Research",
  "Politics",
  "Media",
  "Entrepreneurship",
  "STEM",
] as const;

export default async function Home() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const isAuthenticated = !!authData.user;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader isAuthenticated={isAuthenticated} />
      <LandingExperience categories={CATEGORIES} isAuthenticated={isAuthenticated} />
    </div>
  );
}
