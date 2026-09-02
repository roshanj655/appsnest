import { PartyDirectory } from './Customers'

const Suppliers = () => (
  <PartyDirectory
    title="Suppliers"
    description="Manage vendor contacts and keep your procurement workflow organized."
    addLabel="Add Supplier"
    apiPath="/api/suppliers"
    noun="Supplier"
  />
)

export default Suppliers
