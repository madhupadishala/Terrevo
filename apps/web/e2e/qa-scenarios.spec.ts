import {test,expect} from "@playwright/test";

async function scenario(page:any,id:string){
  await page.getByTestId("qa-scenario-toggle").click();
  await page.getByTestId("qa-scenario-"+id.toLowerCase()).click();
  await page.getByTestId("qa-scenario-toggle").click();
}

test("FULL_FIELD_DAY exercises detailing, sampling, chemist RCPA and POB through one provider state",async({page})=>{
  await page.goto("/");
  await scenario(page,"FULL_FIELD_DAY");

  await page.getByRole("button",{name:"E-detailing / CLM",exact:true}).click();
  await expect(page.getByText("Core Brand Aid",{exact:true})).toBeVisible();
  await page.getByTestId("clm-detail-CLM-001").click();
  await expect(page.getByRole("heading",{name:"Core Brand Aid"})).toBeVisible();
  await page.getByTestId("clm-next-slide").click();
  await page.getByTestId("clm-end-detailing").click();
  await page.getByTestId("clm-review-session").click();
  await page.getByTestId("clm-reaction").selectOption("POSITIVE");
  await page.getByTestId("clm-save-session").click();
  await expect(page.getByText("Functional QA detailing session recorded.")).toBeVisible();

  await page.getByRole("button",{name:"Samples & inventory",exact:true}).click();
  await page.getByTestId("inventory-item").selectOption("SMP-01");
  await page.getByTestId("inventory-qty").fill("2");
  await page.getByTestId("inventory-distribute").click();
  await expect(page.getByText("Distribution recorded",{exact:true})).toBeVisible();
  await expect(page.getByTestId("inventory-row-SMP-01")).toContainText("Available 74");

  await page.getByRole("button",{name:"Field execution",exact:true}).click();
  await page.getByTestId("visit-outcome").fill("Detailed and sampled");
  await page.getByTestId("visit-complete").click();
  await page.getByTestId("visit-checkin-visit-chem-01").click();
  await expect(page.getByText("Checked in",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"RCPA & orders",exact:true}).click();
  await expect(page.getByTestId("rcpa-save")).toBeEnabled();
  await page.getByTestId("rcpa-brand-qty").fill("60");
  await page.getByTestId("rcpa-competitor-qty").fill("40");
  await page.getByTestId("rcpa-rx").fill("20");
  await page.getByTestId("rcpa-save").click();
  await expect(page.getByText("RCPA saved",{exact:true})).toBeVisible();
  await page.getByTestId("pob-quantity").fill("5");
  await expect(page.getByTestId("pob-book")).toBeEnabled();
  await page.getByTestId("pob-book").click();
  await expect(page.getByText("POB booked",{exact:true})).toBeVisible();
});

test("VALIDATION_ERRORS exposes controlled failures rather than fabricated success",async({page})=>{
  await page.goto("/");
  await scenario(page,"VALIDATION_ERRORS");

  await page.getByRole("button",{name:"RCPA & orders",exact:true}).click();
  await expect(page.getByTestId("rcpa-save")).toBeDisabled();
  await expect(page.getByTestId("rcpa-disabled-reason")).toContainText("authorized doctor");
  await expect(page.getByTestId("pob-book")).toBeDisabled();
  await expect(page.getByTestId("pob-disabled-reason")).toContainText("authorized stockist");

  await page.getByRole("button",{name:"Samples & inventory",exact:true}).click();
  await expect(page.getByTestId("inventory-row-SMP-01")).toContainText("Available 0");

  await page.getByRole("button",{name:"E-detailing / CLM",exact:true}).click();
  await expect(page.getByText("Legacy Aid",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Safety Alert",{exact:true})).toHaveCount(0);
});

test("MANAGER_QUEUE approvals derive from and mutate underlying rep records",async({page})=>{
  await page.goto("/");
  await scenario(page,"MANAGER_QUEUE");
  await page.getByRole("button",{name:"Manager command",exact:true}).click();
  await expect(page.getByTestId("qa-manager-command")).toContainText("Pending DCRs");
  const first=page.locator('[data-testid^="manager-queue-"]').first();
  await expect(first).toBeVisible();
  const before=await page.locator('[data-testid^="manager-queue-"]').count();
  await first.getByRole("button",{name:"Approve"}).click();
  await expect(page.getByText("Approved",{exact:true})).toBeVisible();
  await expect(page.locator('[data-testid^="manager-queue-"]')).toHaveCount(before-1);
});

test("COMPLETED_DAY is locked and EMPTY_TENANT renders true zero states",async({page})=>{
  await page.goto("/");
  await scenario(page,"COMPLETED_DAY");
  await page.getByRole("button",{name:"Daily call reports",exact:true}).click();
  await expect(page.getByTestId("dcr-submit")).toBeDisabled();
  await expect(page.getByText("SUBMITTED",{exact:true})).toBeVisible();

  await scenario(page,"EMPTY_TENANT");
  await page.getByRole("button",{name:"Customer 360",exact:true}).click();
  await expect(page.getByText("No matching authorized customers.")).toBeVisible();
  await page.getByRole("button",{name:"Samples & inventory",exact:true}).click();
  await expect(page.getByText("No inventory allocated.")).toBeVisible();
});

test("NORMAL_DAY supports NCA master selections and duration validation",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"NCA & activities",exact:true}).click();
  await page.getByTestId("nca-kind").selectOption("NON_CALL_ACTIVITY");
  await page.getByTestId("nca-phase").selectOption("PLAN");
  await expect(page.getByTestId("nca-category")).toContainText("MEETING");
  await expect(page.getByTestId("nca-town")).toContainText("Hyderabad");
  await page.getByTestId("nca-category").selectOption("MEETING");
  await page.getByTestId("nca-town").selectOption("Hyderabad");
  await page.getByTestId("nca-reason").fill("Regional meeting");
  await page.getByTestId("nca-duration").fill("15");
  await expect(page.getByText("NCA duration must be between 30 minutes and 10 hours.")).toBeVisible();
  await page.getByTestId("nca-duration").fill("60");
  await expect(page.getByTestId("nca-review")).toBeEnabled();
});
