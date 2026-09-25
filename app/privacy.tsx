import { Text } from "react-native";
import LegalPage, { LegalSection } from "../components/LegalPage";

const EFFECTIVE_DATE = "September 24, 2026";
const CONTACT_EMAIL = "totliloko@proton.me";

const sections: LegalSection[] = [
  {
    title: "1. Scope",
    paragraphs: [
      "This Privacy Policy explains how PolyOpen collects, uses, discloses, retains, and protects information when you use its applications, websites, live features, and related services.",
    ],
  },
  {
    title: "2. Information you provide",
    paragraphs: [
      "PolyOpen collects information you choose to submit when creating and using an account.",
    ],
    bullets: [
      "Account details such as email address, authentication data, display name, and username.",
      "Profile information such as biography, age or birth information, gender, relationship preferences, city, state, spiritual interests, zodiac information, and numerology information.",
      "Photos, videos, posts, comments, reactions, profile details, and other content you upload.",
      "Messages, live-room chat, reports, blocks, Secret Admirer actions, Speed Dating decisions, and connection activity.",
      "Communications you send to PolyOpen for support, safety, billing, or legal requests.",
    ],
  },
  {
    title: "3. Camera, microphone, and live communications",
    paragraphs: [
      "PolyOpen requests camera and microphone access only when needed for features such as live rooms and live Speed Dates. Audio and video are transmitted to provide the communication you request.",
      "PolyOpen does not use facial recognition, face or expression analysis, voice analysis, movement tracking, emotion detection, or behavioral surveillance.",
      "PolyOpen does not intentionally record private live calls unless a future recording feature gives clear notice and obtains the permissions required by law.",
    ],
  },
  {
    title: "4. Information collected automatically",
    paragraphs: [
      "When you use PolyOpen, technical information may be collected to operate, secure, and diagnose the service.",
    ],
    bullets: [
      "Device type, operating system, app version, network information, language, timestamps, and technical logs.",
      "Push-notification tokens and notification interaction information.",
      "Security, authentication, session, crash, and fraud-prevention information.",
      "Advertising identifiers and ad interaction information where advertisements are enabled.",
      "Feature activity needed to provide feeds, discovery, subscriptions, boosts, live services, and account history.",
    ],
  },
  {
    title: "5. Location information",
    paragraphs: [
      "PolyOpen may use profile location information you provide, such as city and state, to support discovery and distance preferences.",
      "The current app configuration does not request precise GPS-location permission. PolyOpen will update this Policy and request permission before collecting precise device location in the future.",
    ],
  },
  {
    title: "6. How information is used",
    paragraphs: [
      "PolyOpen uses information to provide and maintain the service.",
    ],
    bullets: [
      "Create accounts and display member-selected profile information.",
      "Provide discovery, social feeds, messaging, connections, live rooms, Speed Dating, and safety controls.",
      "Process subscriptions, purchases, boosts, tips, gifts, VIP status, and verification access.",
      "Deliver notifications and respond to support requests.",
      "Prevent spam, fraud, abuse, unauthorized access, and violations of community rules.",
      "Debug, secure, measure, and improve service reliability and accessibility.",
      "Comply with law and enforce the Terms of Use.",
    ],
  },
  {
    title: "7. Public and member-visible information",
    paragraphs: [
      "Profile information and content you mark as public may be visible to other members or visitors. Visibility may also depend on the audience setting attached to a post, live room, or feature.",
      "Do not publish addresses, financial information, passwords, private documents, or information you do not want others to see.",
    ],
  },
  {
    title: "8. Service providers",
    paragraphs: [
      "PolyOpen discloses information to service providers only as reasonably necessary for them to perform services on PolyOpen's behalf.",
    ],
    bullets: [
      "Supabase for authentication, databases, storage, and backend services.",
      "LiveKit infrastructure for real-time audio and video transmission.",
      "Expo services for application infrastructure, updates, and notifications.",
      "RevenueCat for subscription and entitlement management.",
      "Stripe for web payment processing.",
      "Google AdMob for advertisements where ads are enabled.",
    ],
  },
  {
    title: "9. Payments",
    paragraphs: [
      "Payment information is submitted to the applicable payment provider. PolyOpen may receive transaction identifiers, product information, subscription status, expiration information, and limited billing details needed to provide access and support purchases.",
      "PolyOpen does not receive or store your complete payment-card number through RevenueCat Web Billing and Stripe checkout.",
    ],
  },
  {
    title: "10. Advertising",
    paragraphs: [
      "Free members may see advertisements supplied through Google AdMob. Advertising providers may process device identifiers, IP address, approximate location derived from network information, ad interactions, and consent choices according to their own policies and applicable law.",
      "Members with eligible No Ads, Premium Bundle, or VIP access will not be shown PolyOpen's supported in-app advertisements while that access remains active.",
    ],
  },
  {
    title: "11. Legal and safety disclosures",
    paragraphs: [
      "PolyOpen may preserve or disclose information when reasonably necessary to comply with law, respond to valid legal process, protect a person from serious harm, investigate fraud or abuse, enforce agreements, or defend legal rights.",
      "PolyOpen does not sell private messages, live audio, or live video.",
    ],
  },
  {
    title: "12. Data retention",
    paragraphs: [
      "PolyOpen retains information for as long as reasonably necessary to provide the service, maintain legitimate business and security records, complete transactions, resolve disputes, enforce agreements, and comply with legal obligations.",
      "Retention varies by data type. Deleted information may remain temporarily in backups, fraud-prevention records, transaction records, safety evidence, and legally required records.",
    ],
  },
  {
    title: "13. Your choices and rights",
    paragraphs: [
      "Depending on your location, you may have rights to access, correct, delete, restrict, object to, or obtain a copy of personal information. You may also have the right to withdraw consent or appeal a privacy decision.",
    ],
    bullets: [
      "Update available profile information through PolyOpen's account controls.",
      "Control camera, microphone, photo-library, and notification permissions through device settings.",
      "Control eligible advertising choices through device and consent settings.",
      "Cancel subscriptions through the applicable subscription-management portal.",
      "Request account or data deletion by contacting PolyOpen.",
    ],
  },
  {
    title: "14. Security",
    paragraphs: [
      "PolyOpen uses administrative, technical, and organizational safeguards designed to protect information. No internet service or storage system can guarantee absolute security.",
      "You are responsible for using a strong password, protecting your device, and reporting suspected unauthorized access promptly.",
    ],
  },
  {
    title: "15. Adults only",
    paragraphs: [
      "PolyOpen is intended only for adults who are at least 18 years old. PolyOpen does not knowingly permit minors to create accounts. Contact PolyOpen if you believe a minor has supplied personal information.",
    ],
  },
  {
    title: "16. International use",
    paragraphs: [
      "PolyOpen may process information in the United States and other locations where its service providers operate. Privacy protections may differ from those in your jurisdiction.",
    ],
  },
  {
    title: "17. Changes to this Policy",
    paragraphs: [
      "PolyOpen may update this Policy to reflect changes in features, service providers, security practices, or law. Material changes will be communicated through reasonable means and the effective date will be revised.",
    ],
  },
  {
    title: "18. Contact and privacy requests",
    paragraphs: [
      `Send privacy questions, rights requests, and deletion requests to ${CONTACT_EMAIL}. PolyOpen may need to verify that a request concerns your account before acting on it.`,
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      introduction={
        <>
          <Text>
            PolyOpen respects member privacy and collects only information
            reasonably needed to provide, protect, and improve the service.
          </Text>
          <Text>
            This Policy should be read together with the Terms of Use.
          </Text>
        </>
      }
      sections={sections}
    />
  );
}
