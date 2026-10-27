export const logoUrl = `${import.meta.env.BASE_URL}umbra-logo.png`;

export default function Logo({
  className = "",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      className={`umbra-logo ${className}`}
      src={logoUrl}
      alt={decorative ? "" : "UMBRA"}
      width={1254}
      height={1254}
      draggable={false}
    />
  );
}
