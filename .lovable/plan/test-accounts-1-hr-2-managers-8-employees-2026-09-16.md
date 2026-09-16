# Test accounts: 1 HR, 2 managers, 8 employees

Create 11 fresh sign-in accounts inside **Demo Company** so you can test every role side by side. They will be added alongside the existing people, not replacing them.

## Accounts to create

All use the same password: `TestPass#2026`

| Role | Name | Email |
|---|---|---|
| HR | Priya Nair | test.hr1@demo.hrms |
| Manager | Vikram Joshi | test.mgr1@demo.hrms |
| Manager | Sneha Pillai | test.mgr2@demo.hrms |
| Employee | Ananya Das | test.emp1@demo.hrms |
| Employee | Rahul Nanda | test.emp2@demo.hrms |
| Employee | Farhan Qureshi | test.emp3@demo.hrms |
| Employee | Divya Menon | test.emp4@demo.hrms |
| Employee | Karan Bhatia | test.emp5@demo.hrms |
| Employee | Nisha Rani | test.emp6@demo.hrms |
| Employee | Aditya Kulkarni | test.emp7@demo.hrms |
| Employee | Sana Shaikh | test.emp8@demo.hrms |

## Reporting structure

- Employees 1-4 report to Vikram Joshi
- Employees 5-8 report to Sneha Pillai
- Both managers report to Priya Nair (HR)

This lets you test the manager team view, first-stage approvals and HR second-stage approvals with realistic data.

## What each account gets

- A profile with joining date, department (assigned to existing departments in the company) and active status
- Correct role in the company so the menu matches the role
- Starting leave balances for the company's enabled leave types, so leave requests can be applied and approved right away

## Technical notes

- Accounts are created directly in the auth system with email confirmed, so no invite code or email verification step is needed.
- Profiles, roles and leave balances are inserted with `company_id` set to Demo Company (`be0952aa-...`), matching the existing multi-tenant rules.
- `manager_id` on each employee profile points at the manager's profile row.
- Every record uses the `test.` email prefix so the whole set can be removed in one step later when you ask.

After this runs I will give you the full list of emails and the shared password in chat.
