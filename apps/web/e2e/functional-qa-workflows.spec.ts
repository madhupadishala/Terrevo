import {test,expect} from "@playwright/test";

async function chooseScenario(page:any,id:string){
  await page.getByTestId("qa-scenario-toggle").click();
  await page.getByTestId("qa-scenario-"+id.toLowerCase()).click();
  await page.getByTestId("qa-scenario-toggle").click();
}

test("provider-backed QA field lifecycle rolls CLM samples trade and DCR into one locked day",async({page})=>{
  await page.goto("/");
  const consoleErrors:string[]=[];
  page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text())});

  await page.getByTestId("nav-field").click();
  await page.getByTestId("visit-checkin-visit-doc-01").click();
  await expect(page.getByText("Checked in",{exact:true})).toBeVisible();

  await page.getByTestId("nav-edetailing").click();
  await page.getByTestId("clm-detail-CLM-001").click();
  await page.getByTestId("clm-next-slide").click();
  await page.getByTestId("clm-end-detailing").click();
  await page.getByTestId("clm-review-session").click();
  await page.getByTestId("clm-reaction").selectOption("POSITIVE");
  await page.getByTestId("clm-save-session").click();
  await expect(page.getByText("Functional QA detailing session recorded.")).toBeVisible();

  await page.getByTestId("nav-inventory").click();
  await expect(page.getByTestId("inventory-row-SMP-01")).toContainText("Available 78");
  await page.getByTestId("inventory-item").selectOption("SMP-01");
  await page.getByTestId("inventory-qty").fill("2");
  await page.getByTestId("inventory-distribute").click();
  await expect(page.getByTestId("inventory-row-SMP-01")).toContainText("Available 76");

  await page.getByTestId("nav-field").click();
  await page.getByTestId("visit-complete").click();
  await page.getByTestId("visit-checkin-visit-chem-01").click();

  await page.getByTestId("nav-trade").click();
  await expect(page.getByText("READY",{exact:true})).toHaveCount(2);
  await page.getByTestId("rcpa-brand-qty").fill("60");
  await page.getByTestId("rcpa-competitor-qty").fill("40");
  await page.getByTestId("rcpa-rx").fill("20");
  await page.getByTestId("rcpa-save").click();
  await expect(page.getByText("RCPA saved",{exact:true})).toBeVisible();
  await page.getByTestId("pob-quantity").fill("5");
  await page.getByTestId("pob-book").click();
  await expect(page.getByText("POB booked",{exact:true})).toBeVisible();

  await page.getByTestId("nav-field").click();
  await page.getByTestId("visit-complete").click();
  await page.getByTestId("visit-checkin-visit-stock-01").click();
  await page.getByTestId("visit-complete").click();

  await page.getByTestId("nav-reports").click();
  await expect(page.getByText("Completed visits: 3")).toBeVisible();
  await page.getByTestId("dcr-submit").click();
  await expect(page.getByText("DCR submitted and day locked",{exact:true})).toBeVisible();
  await expect(page.getByTestId("dcr-submit")).toBeDisabled();
  expect(consoleErrors).toEqual([]);
});

test("NCA, workforce and manager approvals mutate the centralized provider",async({page})=>{
  await page.goto("/");
  await page.getByTestId("nav-activities").click();
  await page.getByTestId("nca-kind").selectOption("NON_CALL_ACTIVITY");
  await page.getByTestId("nca-phase").selectOption("PLAN");
  await page.getByTestId("nca-category").selectOption("MEETING");
  await page.getByTestId("nca-town").selectOption("town-hyd");
  await page.getByTestId("nca-reason").fill("Territory review");
  await page.getByTestId("nca-duration").fill("60");
  await page.getByTestId("nca-remarks").fill("Functional QA NCA");
  await page.getByTestId("nca-review").click();
  await page.getByTestId("activity-save").click();
  await expect(page.getByText("NCA draft created in provider.")).toBeVisible();

  await page.getByTestId("nav-workforce").click();
  await page.getByTestId("leave-reason").fill("QA leave request");
  await page.getByTestId("leave-submit").click();
  await expect(page.getByText("Leave submitted",{exact:true})).toBeVisible();
  await page.getByTestId("expense-amount").fill("275");
  await page.getByTestId("expense-save").click();
  await expect(page.getByText("Expense draft saved",{exact:true})).toBeVisible();

  await chooseScenario(page,"MANAGER_QUEUE");
  await page.getByTestId("nav-manager").click();
  const firstApprove=page.locator('[data-testid^="manager-approve-"]').first();
  await expect(firstApprove).toBeVisible();
  const before=await page.locator('[data-testid^="manager-queue-"]').count();
  await firstApprove.click();
  await expect(page.getByText("Approved",{exact:true})).toBeVisible();
  await expect(page.locator('[data-testid^="manager-queue-"]')).toHaveCount(before-1);
});

test("all six deterministic scenarios are hot-swappable and edge states are enforced",async({page})=>{
  await page.goto("/");
  for(const id of ["NORMAL_DAY","FULL_FIELD_DAY","MANAGER_QUEUE","VALIDATION_ERRORS","COMPLETED_DAY","EMPTY_TENANT"]){
    await chooseScenario(page,id);
    await expect(page.getByText("Scenario: "+id,{exact:true})).toBeVisible();
  }

  await chooseScenario(page,"VALIDATION_ERRORS");
  await page.getByTestId("nav-inventory").click();
  await expect(page.getByTestId("inventory-row-SMP-01")).toContainText("Available 0");
  await page.getByTestId("nav-trade").click();
  await expect(page.getByTestId("rcpa-disabled-reason")).toContainText("Map this chemist");
  await expect(page.getByTestId("pob-disabled-reason")).toContainText("Map this chemist");

  await chooseScenario(page,"COMPLETED_DAY");
  await page.getByTestId("nav-reports").click();
  await expect(page.getByTestId("dcr-submit")).toBeDisabled();

  await chooseScenario(page,"EMPTY_TENANT");
  await page.getByTestId("nav-customers").click();
  await expect(page.getByText("No matching authorized customers.")).toBeVisible();
});
