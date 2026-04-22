export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const angle = Number(searchParams.get("angle") ?? 240);

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const length = (circumference * angle) / 360;

  const markup = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="${radius}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-dasharray="${length} ${circumference}"/></svg>`;

  return new Response(markup, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
