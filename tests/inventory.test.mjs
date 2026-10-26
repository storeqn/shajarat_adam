import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync('migrations/0001.sql','utf8'));
 db.exec(readFileSync('migrations/0002_stock_reservation.sql','utf8'));
 db.exec("INSERT INTO products(id,name) VALUES('cake','Cake')");
 db.exec("INSERT INTO product_variants(id,product_id,name,price,stock) VALUES('half','cake','Half kg',10000,3)");
 return db;
}
function order(db,id,qty){
 const items=JSON.stringify([{id:'half',name:'Cake',variant:'Half kg',price:10000,quantity:qty}]);
 db.prepare('INSERT INTO orders(idempotency,payload_hash,customer,items,total,delivery) VALUES(?,?,?,?,?,0)').run('key'+id,'hash','{}',items,10000*qty);
}
test('accepting an order reserves stock, cancelling returns stock',()=>{
 const db=setup();order(db,1,2);
 assert.equal(db.prepare("SELECT stock FROM product_variants WHERE id='half'").get().stock,3);
 db.exec("UPDATE orders SET status='تم الاستلام من المحل' WHERE id=1");
 assert.equal(db.prepare("SELECT stock FROM product_variants WHERE id='half'").get().stock,1);
 db.exec("UPDATE orders SET status='ملغي' WHERE id=1");
 assert.equal(db.prepare("SELECT stock FROM product_variants WHERE id='half'").get().stock,3);
 assert.throws(()=>db.exec("UPDATE orders SET status='تم الاستلام من المحل' WHERE id=1"));
});
test('insufficient inventory rejects confirmation atomically',()=>{
 const db=setup();order(db,1,4);
 assert.throws(()=>db.exec("UPDATE orders SET status='تم الاستلام من المحل' WHERE id=1"));
 assert.equal(db.prepare("SELECT stock FROM product_variants WHERE id='half'").get().stock,3);
 assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status,'بانتظار الإرسال');
});
test('pending orders cannot skip acceptance',()=>{
 const db=setup();order(db,1,1);
 assert.throws(()=>db.exec("UPDATE orders SET status='مكتمل' WHERE id=1"));
});
