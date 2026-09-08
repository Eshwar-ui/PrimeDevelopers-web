import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import LegalPage, { Clause, ClauseList } from '../components/LegalPage'

/**
 * NOT LEGAL ADVICE, AND NOT YET REVIEWED BY COUNSEL.
 *
 * The clauses that actually matter for this site are the ones about property
 * information: a listing page here shows renderings, indicative pricing and
 * unit availability that moves, and none of that is an offer. Everything else
 * is standard, and the standard version is what is written here.
 *
 * To check before this is treated as final: the registered entity name
 * (`footer.legalName`, blank in the CMS), and the venue named in the governing
 * law clause — Travis County is assumed from the Austin address.
 */

const HEADINGS = [
  'Agreeing to these terms',
  'Who we are',
  'Using this site',
  'Property information is not an offer',
  'Fair housing',
  'What you send us',
  'Our content',
  'Links to other sites',
  'No warranty',
  'Limits on our liability',
  'Governing law',
  'Changes to these terms',
  'Contact us',
]

export default function TermsPage() {
  const { email, phone, legalName } = useSection('footer')
  const entity = legalName || 'Prime Developers'
  const telHref = phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : null

  return (
    <LegalPage
      title="Terms of Use"
      summary="The rules for using this website, and the limits of what the information on it means."
      updated="5 September 2026"
      headings={HEADINGS}
    >
      <Clause title="Agreeing to these terms">
        <p>
          By using this website you accept these terms. If you do not accept them, please do not use
          the site. These terms govern the website only — if you sign a purchase agreement, a lease
          or any other contract with us, that document governs the deal, and it takes precedence
          over anything here.
        </p>
      </Clause>

      <Clause title="Who we are">
        <p>
          This site is operated by {entity}, a real estate developer operating in Texas.
          &ldquo;We&rdquo; and &ldquo;us&rdquo; mean that company; &ldquo;you&rdquo; means whoever
          is using the site.
        </p>
      </Clause>

      <Clause title="Using this site">
        <p>You may browse the site, and use the forms on it to contact us. You may not:</p>
        <ClauseList
          items={[
            'Submit false information, or use someone else’s contact details without their permission.',
            'Scrape, crawl or bulk-download the site, or use automated means to submit the forms.',
            'Attempt to gain access to the admin area, any account, or any system behind the site.',
            'Interfere with the site’s operation, or use it in a way that breaks the law.',
          ]}
        />
        <p>
          We may restrict access for anyone who does these things, without needing to warn them
          first.
        </p>
      </Clause>

      <Clause title="Property information is not an offer">
        <p>This is the clause that matters most on a site like this one. Please read it.</p>
        <ClauseList
          items={[
            'Nothing on this site is an offer to sell or lease, and nothing on it creates a binding agreement. An offer is made in writing, in a signed contract, and nowhere else.',
            'Prices, availability, unit mixes, floor areas, specifications, phases and completion dates are indicative and change. A unit shown as available may have been reserved since the page was last updated.',
            'Renderings, plans, floor plans, elevations, dimensions and site plans are illustrative. Finished construction differs from the images shown, and areas are approximate and measured to a stated standard that varies by project.',
            'Where we describe a location — travel times, nearby amenities, schools, planned infrastructure — we are describing our present understanding of the area, not making a promise about it.',
            'Any figure presented as a return, yield or projection is a forecast and not a guarantee. Property values fall as well as rise. Nothing on this site is financial, tax or investment advice, and you should take your own before committing to anything.',
          ]}
        />
        <p>
          Verify anything you intend to rely on with us directly, in writing, before you act on it.
        </p>
      </Clause>

      <Clause title="Fair housing">
        <p>
          We are committed to the letter and the spirit of the Fair Housing Act and to equal
          opportunity in housing. We do not discriminate on the basis of race, colour, religion,
          sex, disability, familial status or national origin — or on any other basis prohibited by
          federal, state or local law — in the sale, rental, financing or advertising of housing.
        </p>
        <p>
          If anything on this site reads otherwise, that is a fault we want to know about and
          correct. Tell us.
        </p>
      </Clause>

      <Clause title="What you send us">
        <p>
          When you send us an enquiry, you confirm the details are yours and are accurate, and you
          agree we may contact you about it. How we handle what you send is set out in our{' '}
          <Link className="text-accent underline underline-offset-4" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          If you send us an unsolicited idea, suggestion or proposal, we may use it without owing
          you anything for it. Do not send us anything you consider confidential through this site.
        </p>
      </Clause>

      <Clause title="Our content">
        <p>
          The text, photography, renderings, plans, video, logos and design of this site belong to
          us or to our licensors, and are protected by copyright and trade mark law. You may view
          and print pages for your own use in considering a property. You may not republish, resell,
          or use any of it commercially without our written permission, and you may not use our name
          or marks in a way that suggests an endorsement or association that does not exist.
        </p>
      </Clause>

      <Clause title="Links to other sites">
        <p>
          Where we link to a third party, we are pointing at something we thought was useful. We do
          not control those sites, we are not responsible for their content or their privacy
          practices, and a link is not an endorsement.
        </p>
      </Clause>

      <Clause title="No warranty">
        <p>
          The site is provided as it is. We work to keep it accurate and available, but we do not
          warrant that it will be uninterrupted, error-free, or free of anything harmful, and we do
          not warrant that the information on it is complete or current. To the fullest extent the
          law allows, we disclaim the implied warranties of merchantability, fitness for a
          particular purpose and non-infringement.
        </p>
      </Clause>

      <Clause title="Limits on our liability">
        <p>
          To the fullest extent the law allows, we are not liable for indirect, incidental,
          consequential, special or punitive damages arising out of your use of this site, or for
          any loss of profit, revenue, data or opportunity — including where you relied on
          information here that turned out to be out of date.
        </p>
        <p>
          Nothing in these terms limits liability for fraud, for fraudulent misrepresentation, or
          for anything else that cannot be limited under Texas law.
        </p>
      </Clause>

      <Clause title="Governing law">
        <p>
          These terms are governed by the laws of the State of Texas, without regard to its conflict
          of laws rules. Any dispute arising out of them or out of your use of this site belongs in
          the state or federal courts sitting in Travis County, Texas, and you agree to that venue.
        </p>
      </Clause>

      <Clause title="Changes to these terms">
        <p>
          We may revise these terms. The date at the top of the page is the date of the current
          version, and using the site after a change means you accept the revised terms.
        </p>
      </Clause>

      <Clause title="Contact us">
        <p>
          {email ? (
            <>
              Email{' '}
              <a className="text-accent underline underline-offset-4" href={`mailto:${email}`}>
                {email}
              </a>
              {telHref ? ', or call ' : '.'}
            </>
          ) : null}
          {telHref ? (
            <>
              <a className="text-accent underline underline-offset-4" href={telHref}>
                {phone}
              </a>
              .
            </>
          ) : null}
        </p>
      </Clause>
    </LegalPage>
  )
}
