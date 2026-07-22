package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// daybookXML is a realistic Tally daybook export for "Nexus Hardware Traders"
// covering April–December 2025 with 22 vouchers.
const daybookXML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="Receipt" DATE="20250410" NARRATION="Payment from Tata Steel for Q4 supply" AMOUNT="-250000" PARTYLEDGERNAME="Tata Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250415" NARRATION="Office rent April 2025" AMOUNT="45000" PARTYLEDGERNAME="Shri Ram Properties"></VOUCHER>
        <VOUCHER VCHTYPE="Sales" DATE="20250420" NARRATION="Hardware sale - Bolt assortment batch 1" AMOUNT="-180000" PARTYLEDGERNAME="Wipro Enterprises"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250430" NARRATION="Staff salary April 2025" AMOUNT="120000" PARTYLEDGERNAME="Staff Salary Account"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20250508" NARRATION="Advance payment from L&amp;T construction" AMOUNT="-500000" PARTYLEDGERNAME="L&amp;T Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Purchase" DATE="20250515" NARRATION="Raw material - MS rods from Bhushan Steel" AMOUNT="320000" PARTYLEDGERNAME="Bhushan Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20250522" NARRATION="Payment from Infosys for facility fitout" AMOUNT="-75000" PARTYLEDGERNAME="Infosys Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250531" NARRATION="Staff salary May 2025" AMOUNT="120000" PARTYLEDGERNAME="Staff Salary Account"></VOUCHER>
        <VOUCHER VCHTYPE="Sales" DATE="20250610" NARRATION="Hardware sale - Fasteners bulk order Q1" AMOUNT="-420000" PARTYLEDGERNAME="Wipro Enterprises"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250615" NARRATION="Office rent June 2025" AMOUNT="45000" PARTYLEDGERNAME="Shri Ram Properties"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20250618" NARRATION="Receipt from Tata Steel - balance payment" AMOUNT="-150000" PARTYLEDGERNAME="Tata Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Purchase" DATE="20250625" NARRATION="Raw material - GI sheets from JSW Steel" AMOUNT="210000" PARTYLEDGERNAME="JSW Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250630" NARRATION="Staff salary June 2025" AMOUNT="120000" PARTYLEDGERNAME="Staff Salary Account"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20250710" NARRATION="Q2 advance from L&amp;T construction" AMOUNT="-380000" PARTYLEDGERNAME="L&amp;T Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Sales" DATE="20250725" NARRATION="Conduit pipes and fittings - Infosys campus" AMOUNT="-95000" PARTYLEDGERNAME="Infosys Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250731" NARRATION="Electricity and utility bill July 2025" AMOUNT="28000" PARTYLEDGERNAME="Utility Provider"></VOUCHER>
        <VOUCHER VCHTYPE="Purchase" DATE="20250812" NARRATION="Inventory replenishment - anchor bolts" AMOUNT="145000" PARTYLEDGERNAME="Bhushan Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20250820" NARRATION="Payment from Wipro - software fitout hardware" AMOUNT="-220000" PARTYLEDGERNAME="Wipro Enterprises"></VOUCHER>
        <VOUCHER VCHTYPE="Payment" DATE="20250831" NARRATION="Staff salary August 2025" AMOUNT="120000" PARTYLEDGERNAME="Staff Salary Account"></VOUCHER>
        <VOUCHER VCHTYPE="Sales" DATE="20250915" NARRATION="Q3 quarterly hardware bulk - Tata Steel" AMOUNT="-480000" PARTYLEDGERNAME="Tata Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Purchase" DATE="20251005" NARRATION="Raw material restock - mild steel angles" AMOUNT="275000" PARTYLEDGERNAME="JSW Steel Ltd"></VOUCHER>
        <VOUCHER VCHTYPE="Receipt" DATE="20251120" NARRATION="Year-end clearance from L&amp;T construction" AMOUNT="-310000" PARTYLEDGERNAME="L&amp;T Ltd"></VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`

func main() {
	r := gin.Default()

	// POST / — Tally ERP accepts all requests at the root path.
	r.POST("/", func(c *gin.Context) {
		log.Println("Tally mock: received daybook export request")
		c.Data(http.StatusOK, "text/xml; charset=utf-8", []byte(daybookXML))
	})

	log.Println("Starting Tally mock on port 9094")
	if err := r.Run(":9094"); err != nil {
		log.Fatal(err)
	}
}
