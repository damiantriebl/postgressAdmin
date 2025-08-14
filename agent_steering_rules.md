# Steering rules

- El agente **no debe modificar** scripts de migración sin aprobación explícita del usuario.
- Si el diff detecta posibles destructivas (`DROP TABLE`, índices…), debe **alertar y detener** antes de aplicar.
- Las pruebas deben pasar en backend antes de ejecutar migración en vivo.
- Toda acción crítica (backup/restore) debe pedir confirmación en UI.
- El agente propone cambios en docs o tests, pero **espera revisión manual** antes de hacer commit automático.
