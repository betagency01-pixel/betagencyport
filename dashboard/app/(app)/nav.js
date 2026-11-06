'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ fresh, owner }) {
  const p = usePathname();
  const items = [['/', 'Overview'], ['/enquiries', 'Enquiries'], ['/visitors', 'Visitors'], ['/team', owner ? 'Team' : 'My account']];
  return (
    <nav className="nav">
      {items.map(([href, label]) => {
        const on = href === '/' ? p === '/' : p.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? 'on' : ''}>
            {label}
            {href === '/enquiries' && fresh > 0 && <span className="badge">{fresh}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
