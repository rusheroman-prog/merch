import type { SupportContact } from '@/lib/support'

/** Renders the admin-configured support contact as a link when it has one. */
export default function SupportLink({
  contact,
  className,
}: {
  contact: SupportContact
  className?: string
}) {
  if (!contact.href) {
    return <span className={className}>{contact.label}</span>
  }

  const isExternal = contact.href.startsWith('http')

  return (
    <a
      href={contact.href}
      className={className}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    >
      {contact.label}
    </a>
  )
}
