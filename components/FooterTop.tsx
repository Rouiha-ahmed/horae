import { Clock, Mail, Phone } from "lucide-react";

type FooterTopProps = {
  phone?: string | null;
  hours?: string | null;
  email?: string | null;
};

type ContactItemData = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

export default function FooterTop({ phone, hours, email }: FooterTopProps) {
  const items: Array<ContactItemData | null> = [
    phone
      ? {
          title: "Appelez-nous",
          description: phone,
          icon: <Phone className="h-5 w-5 text-white/40 transition-colors group-hover:text-shop_light_green" />,
        }
      : null,
    hours
      ? {
          title: "Horaires",
          description: hours,
          icon: <Clock className="h-5 w-5 text-white/40 transition-colors group-hover:text-shop_light_green" />,
        }
      : null,
    email
      ? {
          title: "Ecrivez-nous",
          description: email,
          icon: <Mail className="h-5 w-5 text-white/40 transition-colors group-hover:text-shop_light_green" />,
        }
      : null,
  ];
  const data = items.filter((item): item is ContactItemData => item !== null);

  if (!data.length) {
    return null;
  }

  return (
    <div
      id="contact"
      className="grid scroll-mt-28 grid-cols-1 border-b border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-white/10"
    >
      {data.map((item) => (
        <div
          key={item.title}
          className="group flex items-center gap-4 px-4 py-3 transition-colors first:pl-0 last:pr-0"
        >
          {item.icon}
          <div>
            <h3 className="horae-kicker text-shop_light_green">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-white/60 transition-colors group-hover:text-white">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
