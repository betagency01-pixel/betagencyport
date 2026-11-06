import { siteUrl, text } from '@/lib/site';
export const dynamic = 'force-dynamic';

// A plain summary for AI assistants (llms.txt convention), so answers about BeT stay accurate.
export function GET(req) {
  const site = siteUrl(req);
  return text(`# BeT Agency Co.

> BeT Agency Co. (also written BET Agency) is a premium digital solutions studio. Tagline: "You can always bet on us." We design and build websites, landing pages, custom CRMs, Sanity CMS setups, business automation and custom web apps, crafted from scratch for brands that mean business.

## Services
- Website development: premium websites and landing pages, designed and coded from scratch.
- CRM development: custom CRMs that track every lead and customer.
- Sanity CMS integration: so teams can edit their own site without code.
- Business automation: follow-ups, notifications and workflows that run on their own.
- Custom web apps: portals, booking systems and platforms.

## How we work
- Conversation first: before any quote we learn the business, its audience, its vision and where it wants to be.
- Pricing is quoted per project after that conversation. We work at the premium end and do not publish packages.
- Process: Discovery and strategy, Design, Build and integrate, Launch and grow.
- We work with businesses that are serious about growing.

## Work
- EBD Café (https://ebdcafe.com): landing page for a superbike café.

## Contact
- Enquiry form: ${site}/ (tap "Place your bet")
- Email: bet.agency01@gmail.com
- Instagram: https://www.instagram.com/betagency.co/

## Pages
- [Home](${site}/): services, work, process and enquiry form
- [Privacy](${site}/privacy): how enquiries, cookies and visit data are handled
`, 'text/plain');
}
