# Order projection worker

Synthetic Java consumer and MongoDB access interfaces; no drivers are supplied.
Local configuration consumes orders.placed.v2 and stores the order projection.
The configured production topic and deployed revisions are unknown.
Acknowledgment, retry, dead-letter routing and database indexes are not implemented here.
No repository in this fixture implements billing.
