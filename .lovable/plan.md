# Custom required-field messages and password visibility

## Goal
Replace browser-default required-field prompts with clear product messages and add a consistent show/hide control to every password field.

## Changes
1. Add shared required-field validation behavior to the existing input control so mandatory fields show a custom message such as “Please enter Full Name”, “Please enter Company Name”, “Please enter Email Address”, “Please enter Password”, or “Please enter Invite Code”.
2. Preserve existing format, length, and business-rule validation while ensuring custom required messages clear immediately after the user enters a value.
3. Add a reusable password input with an accessible eye icon, tooltip/label, stable layout, and keyboard support.
4. Use the password input on Sign Up, Sign In, and both New Password fields on Reset Password.
5. Apply explicit field names where needed on company invitation and setup email fields so their messages remain human-friendly.
6. Verify blank submission, invalid values, password toggling, keyboard focus, and masked-by-default behavior on the account screens.

## Technical details
- Keep validation client-side in the shared React controls; existing backend validation and authorization remain unchanged.
- Use the existing Button component and Lucide Eye/EyeOff icons.
- Do not expose password values in logs, URLs, or messages.
