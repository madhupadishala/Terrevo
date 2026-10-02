# Wave 1 Market Benchmark Assessment

Reviewed: 2026-10-02  
Scope: Sprints 1–5 — tenant/access foundation, hierarchy/RBAC, core masters, tour planning, tour approval.

## Purpose

This is a feature-pattern benchmark, not a claim that Terrevo is functionally equivalent to any named commercial product. The benchmark asks whether the Wave 1 foundations correspond to recognizable enterprise sales/field-force patterns and identifies where Terrevo is product-specific.

## External sources reviewed

### Veeva Vault CRM

1. **Territory Management Overview**  
   https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/TerritoryManagement/Overview.htm  
   Veeva documents territories as groupings of accounts assigned to users, hierarchical territory organization, and territory-driven visibility.

2. **Configuring Call Planning**  
   https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/CallPlanning/CPConfig.htm  
   Veeva documents account information plus planned/saved/submitted call records with territory, date/time, and weekly call-cycle entries.

3. **Configuring Accounts**  
   https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/Accounts/AcctConfig.htm  
   Veeva documents account profile objects, hierarchy relationships, and territory-specific account information.

### Microsoft Dynamics 365 Sales

4. **Set up Sales Territories**  
   https://learn.microsoft.com/en-us/dynamics365/sales/set-up-sales-territories  
   Microsoft documents hierarchical sales territories, parent/child territory relationships, managers, and salesperson membership.

5. **Set up Sales Basics**  
   https://learn.microsoft.com/en-us/dynamics365/sales/sales-basics-setup  
   Microsoft lists business units, sales teams, territories, and product catalogs as basic sales-organization setup resources.

## Wave 1 comparison

| Wave 1 capability | External market pattern | Assessment |
| --- | --- | --- |
| Tenant/access foundation | Enterprise CRM platforms separate organization/user access and use role/territory-based visibility | Foundational control; Terrevo adds explicit tenant isolation because it is built as a multi-tenant SaaS platform |
| Company → division → zone → region → area → territory hierarchy | Veeva documents territory hierarchies; Dynamics documents hierarchical parent/child sales territories | **Aligned pattern**, with a more prescriptive pharma field hierarchy in Terrevo |
| Role + organization scope | Veeva territory assignment governs visibility; Dynamics assigns members/managers to territories | **Aligned principle**: access is scoped by organizational/territory responsibility |
| Core masters (employees, doctors, products, chemists, stockists, samples, gifts) | Veeva accounts/address/territory data and Dynamics product catalog are core sales data patterns | **Aligned foundation**, with pharma-specific master types |
| Weekly tour planning | Veeva Call Planning stores planned/saved/submitted calls and weekly call-cycle entries | **Aligned planning pattern**; Terrevo uses a weekly tour-plan aggregate before visit execution |
| Tour submit + manager approve/reject/return | The reviewed sources establish planning and managerial territory structure but do not document an identical weekly-tour approval state machine | **Product-specific extension**; no parity claim is made |

## Completeness assessment for Wave 1

Wave 1 is complete for its defined foundation scope when its own requirements and mandatory gates pass:

- authenticated identity and tenant selection,
- hierarchical organization/RBAC,
- scoped pharma master data,
- weekly tour plan create/update/submit,
- manager review with approve/reject/return and self-approval prevention.

The benchmark does **not** treat later field-force capabilities—live visit execution, GPS/presence integrity, DCR, inventory/sample execution, orders, expenses, analytics, etc.—as Wave 1 requirements. Those are later waves/modules and should not be used to inflate Wave 1 completeness.

## Result

**Market benchmark evidence: PASS for the defined Wave 1 foundation scope, subject to exact-commit CI and CodeRabbit qualification.**

The benchmark supports the architectural/product direction while preserving explicit differences:
- hierarchical territory and access patterns are established enterprise conventions;
- weekly planning has a direct analogue in Veeva call planning/cycles;
- Terrevo's multi-tenant isolation and weekly tour approval state machine are its own implementation choices and are not presented as copied vendor behavior.
