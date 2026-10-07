import { BookingStudio } from "@/components/booking-studio";
import { SetupNotice } from "@/components/setup-notice";
import { getCatalog } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const catalog = await getCatalog();
    if (catalog.services.length === 0 || catalog.providers.length === 0) {
      return <SetupNotice />;
    }

    return (
      <BookingStudio
        services={catalog.services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          hourlyRateCents: service.hourlyRateCents,
          suggestedDurationMinutes: service.suggestedDurationMinutes,
        }))}
        providers={catalog.providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          bio: provider.bio,
          availability: provider.availability.map((window) => ({
            dayOfWeek: window.dayOfWeek,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
        }))}
      />
    );
  } catch {
    return <SetupNotice />;
  }
}
