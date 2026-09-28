# ADR-011: GPS Evidence and Exception Workflow
Status: Accepted

Geofence distance and GPS accuracy are separate signals. The system never claims a device location is spoof-proof.

A verified check-in is within the configured radius and meets the accuracy threshold. Outside/low-accuracy/no-target-coordinate visits remain capturable only with an explicit exception reason, creating a manager-reviewable pending exception.

Check-in and checkout are transactional and idempotent to survive mobile retries.
