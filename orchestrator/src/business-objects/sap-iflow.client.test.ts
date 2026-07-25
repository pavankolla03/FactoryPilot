import { describe, expect, it } from 'vitest';
import { SapIflowClient } from './sap-iflow.client';

/**
 * The first customer iFlow (/http/materialstockread) returns message-mapping XML
 * rather than JSON or OData Atom: a wrapper element containing repeated row
 * elements. These tests pin the parser against that real shape.
 */
const SAMPLE = `<A_MatlStkInAcctMod>
    <A_MatlStkInAcctModType>
      <WBSElementInternalID>0</WBSElementInternalID>
      <Customer></Customer>
      <Material>MZ-TG-HUP01</Material>
      <InventorySpecialStockType></InventorySpecialStockType>
      <Plant>1710</Plant>
      <MaterialBaseUnit>PC</MaterialBaseUnit>
      <Batch>HU1001</Batch>
      <MatlWrhsStkQtyInMatlBaseUnit>2</MatlWrhsStkQtyInMatlBaseUnit>
      <InventoryStockType>01</InventoryStockType>
      <StorageLocation>171A</StorageLocation>
    </A_MatlStkInAcctModType>
    <A_MatlStkInAcctModType>
      <WBSElementInternalID>0</WBSElementInternalID>
      <Material>TG11</Material>
      <InventorySpecialStockType>E</InventorySpecialStockType>
      <Plant>1010</Plant>
      <MaterialBaseUnit>PC</MaterialBaseUnit>
      <Batch/>
      <MatlWrhsStkQtyInMatlBaseUnit>1</MatlWrhsStkQtyInMatlBaseUnit>
      <SDDocument>60001337</SDDocument>
      <InventoryStockType>07</InventoryStockType>
      <StorageLocation>101R</StorageLocation>
    </A_MatlStkInAcctModType>
</A_MatlStkInAcctMod>`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parse = (xml: string) => (new SapIflowClient() as any).parseXmlRecords(xml) as Array<Record<string, unknown>>;

describe('SapIflowClient XML parsing', () => {
  it('parses iFlow message-mapping XML into records', () => {
    const records = parse(SAMPLE);
    expect(records).toHaveLength(2);
    expect(records[0].Material).toBe('MZ-TG-HUP01');
    expect(records[0].Plant).toBe('1710');
    expect(records[0].MatlWrhsStkQtyInMatlBaseUnit).toBe('2');
    expect(records[0].StorageLocation).toBe('171A');
  });

  it('keeps empty and self-closing elements as empty strings', () => {
    const records = parse(SAMPLE);
    expect(records[0].Customer).toBe('');
    expect(records[1].Batch).toBe('');
  });

  it('picks the repeated row element, not the wrapper', () => {
    const records = parse(SAMPLE);
    // A wrapper-as-row bug would yield a single record.
    expect(records.length).toBeGreaterThan(1);
    expect(records[1].Plant).toBe('1010');
  });

  it('decodes XML entities', () => {
    const records = parse(
      '<Root><Row><Name>Acme &amp; Co &lt;EU&gt;</Name></Row><Row><Name>Second</Name></Row></Root>',
    );
    expect(records[0].Name).toBe('Acme & Co <EU>');
  });

  it('returns an empty list for a payload with no repeated rows', () => {
    expect(parse('<Empty></Empty>')).toEqual([]);
  });
});
