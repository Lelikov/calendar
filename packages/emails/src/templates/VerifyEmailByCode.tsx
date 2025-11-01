import { APP_NAME } from "@calcom/lib/constants";

import type { EmailVerifyCode } from "../../templates/attendee-verify-email";
import { BaseEmailHtml } from "../components";

export const VerifyEmailByCode = (
  props: EmailVerifyCode & Partial<React.ComponentProps<typeof BaseEmailHtml>>
) => {
  return (
    <BaseEmailHtml
      subject={props.language(`verify_email_subject${props.isVerifyingEmail ? "_verifying_email" : ""}`, {
        appName: APP_NAME,
      })}>
      <p
        style={{
          fontWeight: 600,
          fontSize: "32px",
          lineHeight: "38px",
        }}>
        <>{props.language("verify_email_email_header")}</>
      </p>
      <p style={{ fontWeight: 400 }}>
        <>{props.language("hi_user_name", { name: props.user.name })}!</>
      </p>
      <div style={{ lineHeight: "6px" }}>
        <p style={{ fontWeight: 400, lineHeight: "24px" }}>
          <>{props.language("verify_email_by_code_email_body")}</>
          <br />
          <p>{props.verificationEmailCode}</p>
        </p>
      </div>
    </BaseEmailHtml>
  );
};
