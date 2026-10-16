import {test,expect} from "@playwright/test";

test("functional QA provider exposes operational fields without login",async({page})=>{
  const writes:string[]=[];
  page.on("request",request=>{if(["POST","PUT","PATCH","DELETE"].includes(request.method()))writes.push(request.url());});
  await page.goto("/");
  await expect(page.locator("#account-email")).toHaveCount(0);
  await expect(page.getByText("QA DATA PROVIDER",{exact:true})).toBeVisible();
  await expect(page.getByTestId("qa-scenario-toggle")).toBeVisible();

  await page.getByRole("button",{name:"Customer 360",exact:true}).click();
  await expect(page.getByLabel("Search name, code or territory")).toBeVisible();
  await expect(page.getByText("Dr. Ananya Rao",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"NCA & activities",exact:true}).click();
  for(const id of ["#activity-kind","#activity-date","#activity-territory","#activity-reason","#activity-duration","#activity-remarks"])await expect(page.locator(id)).toBeVisible();

  await page.getByRole("button",{name:"E-detailing / CLM",exact:true}).click();
  await expect(page.getByTestId("clm-search")).toBeVisible();
  await expect(page.getByText("Core Brand Aid",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Field execution",exact:true}).click();
  await expect(page.getByTestId("qa-field-execution")).toBeVisible();
  await expect(page.getByTestId("visit-checkin-visit-doc-01")).toBeVisible();

  await page.getByRole("button",{name:"RCPA & orders",exact:true}).click();
  await expect(page.getByTestId("rcpa-product")).toBeVisible();
  await expect(page.getByTestId("pob-product")).toBeVisible();

  await page.getByRole("button",{name:"Samples & inventory",exact:true}).click();
  await expect(page.getByTestId("inventory-item")).toBeVisible();
  await expect(page.getByTestId("inventory-qty")).toBeVisible();

  await page.getByRole("button",{name:"Workforce operations",exact:true}).click();
  await expect(page.getByTestId("leave-from")).toBeVisible();
  await expect(page.getByTestId("expense-category")).toBeVisible();

  await page.getByRole("button",{name:"Manager approvals",exact:true}).click();
  await expect(page.getByTestId("manager-review-comment")).toBeVisible();

  await page.getByRole("button",{name:"Manager command",exact:true}).click();
  await expect(page.getByTestId("qa-manager-command")).toBeVisible();
  await expect(page.getByTestId("manager-command-comment")).toBeVisible();

  await page.getByRole("button",{name:"Organization admin",exact:true}).click();
  await expect(page.getByTestId("org-code")).toBeVisible();
  await expect(page.getByTestId("masters-kind")).toBeVisible();
  await expect(page.getByTestId("assign-user")).toBeVisible();

  await page.getByRole("button",{name:"Platform Super Admin",exact:true}).click();
  await expect(page.getByTestId("platform-name")).toBeVisible();
  await expect(page.getByTestId("platform-code")).toBeVisible();

  expect(writes).toEqual([]);
});
