import type { ComponentType } from 'react'
import { template as devisClientTemplate } from './devis-client'
import { template as devisSigneTemplate } from './devis-signe'
import { template as chantierTermineTemplate } from './chantier-termine'
import { template as chantierArchiveTemplate } from './chantier-archive'
import { template as rdvConfirmeTemplate } from './rdv-confirme'
import { template as rdvPropositionTemplate } from './rdv-proposition'



export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'devis-client': devisClientTemplate,
  'devis-signe': devisSigneTemplate,
  'chantier-termine': chantierTermineTemplate,
  'chantier-archive': chantierArchiveTemplate,
  'rdv-confirme': rdvConfirmeTemplate,
  'rdv-proposition': rdvPropositionTemplate,
}


